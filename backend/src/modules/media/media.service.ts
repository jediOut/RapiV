import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";

import { Business } from "../businesses/business.entity";
import { Product } from "../products/product.entity";
import type { UserRole } from "../users/user.entity";
import { ConfirmUploadDto } from "./dto/confirm-upload.dto";
import { CreateUploadUrlDto, MediaTargetType } from "./dto/create-upload-url.dto";

type MediaUser = {
  sub: string;
  roles: UserRole[];
};

type UploadUrlResponse = {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  expiresInSeconds: number;
};

@Injectable()
export class MediaService {
  private readonly expiresInSeconds = 300;

  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>
  ) {}

  async createUploadUrl(user: MediaUser, dto: CreateUploadUrlDto): Promise<UploadUrlResponse> {
    await this.assertCanWriteTarget(user, dto.targetType, dto.targetId);

    const bucket = this.requiredEnv("AWS_S3_BUCKET");
    const region = process.env.AWS_REGION ?? "us-east-1";
    const objectKey = this.buildObjectKey(user.sub, dto);
    const client = new S3Client({ region });
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: dto.contentType
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: this.expiresInSeconds
    });

    return {
      uploadUrl,
      publicUrl: this.publicUrlFor(objectKey),
      objectKey,
      expiresInSeconds: this.expiresInSeconds
    };
  }

  async confirmUpload(user: MediaUser, dto: ConfirmUploadDto) {
    await this.assertCanWriteTarget(user, dto.targetType, dto.targetId);
    this.assertObjectKeyMatchesTarget(user.sub, dto.targetType, dto.targetId, dto.objectKey);

    const publicUrl = this.publicUrlFor(dto.objectKey);

    if (dto.targetType === "business-logo") {
      const business = await this.businessRepository.findOne({ where: { id: dto.targetId } });

      if (!business) {
        throw new NotFoundException("Business not found");
      }

      business.logo = publicUrl;
      return this.businessRepository.save(business);
    }

    if (dto.targetType === "product-image") {
      const product = await this.productRepository.findOne({ where: { id: dto.targetId } });

      if (!product) {
        throw new NotFoundException("Product not found");
      }

      product.image = publicUrl;
      return this.productRepository.save(product);
    }

    throw new BadRequestException("Unsupported media target");
  }

  private async assertCanWriteTarget(
    user: MediaUser,
    targetType: MediaTargetType,
    targetId?: string
  ): Promise<void> {
    if (!targetId) {
      throw new BadRequestException("targetId is required");
    }

    if (targetType === "business-logo") {
      const business = await this.businessRepository.findOne({ where: { id: targetId } });

      if (!business) {
        throw new NotFoundException("Business not found");
      }

      if (business.ownerUserId !== user.sub) {
        throw new ForbiddenException("User does not own this business");
      }

      return;
    }

    const product = await this.productRepository.findOne({
      where: { id: targetId },
      relations: ["business"]
    });

    if (product) {
      if (product.business.ownerUserId !== user.sub) {
        throw new ForbiddenException("User does not own this product");
      }

      return;
    }

    const business = await this.businessRepository.findOne({ where: { id: targetId } });

    if (!business) {
      throw new NotFoundException("Product or business not found");
    }

    if (business.ownerUserId !== user.sub) {
      throw new ForbiddenException("User does not own this business");
    }
  }

  private buildObjectKey(userId: string, dto: CreateUploadUrlDto): string {
    const extensionByType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    };
    return `media/${dto.targetType}/${dto.targetId}/${randomUUID()}.${extensionByType[dto.contentType]}`;
  }

  private assertObjectKeyMatchesTarget(
    userId: string,
    targetType: MediaTargetType,
    targetId: string | undefined,
    objectKey: string
  ): void {
    const expectedPrefix = `media/${targetType}/${targetId}/`;

    if (!targetId || !objectKey.startsWith(expectedPrefix)) {
      throw new BadRequestException("Object key does not match target");
    }
  }

  private publicUrlFor(objectKey: string): string {
    const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL?.replace(/\/$/, "");

    if (publicBaseUrl) {
      return `${publicBaseUrl}/${objectKey}`;
    }

    const bucket = this.requiredEnv("AWS_S3_BUCKET");
    const region = process.env.AWS_REGION ?? "us-east-1";

    return `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;
  }

  private requiredEnv(key: string): string {
    const value = process.env[key];

    if (!value) {
      throw new Error(`Missing required environment variable ${key}`);
    }

    return value;
  }
}
