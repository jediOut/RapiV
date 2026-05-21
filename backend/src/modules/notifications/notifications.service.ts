import { Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { RegisterPushTokenDto } from "./dto/register-push-token.dto";
import { PushToken } from "./push-token.entity";
import { MonitoringService } from "../monitoring/monitoring.service";

type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepository: Repository<PushToken>,
    @Optional()
    private readonly monitoring?: MonitoringService
  ) {}

  async registerPushToken(userId: string, dto: RegisterPushTokenDto): Promise<{ ok: true }> {
    const existing = await this.pushTokenRepository.findOne({
      where: { token: dto.token }
    });

    const pushToken = this.pushTokenRepository.create({
      ...existing,
      userId,
      token: dto.token,
      app: dto.app,
      deviceId: dto.deviceId,
      lastUsedAt: new Date()
    });

    await this.pushTokenRepository.save(pushToken);
    this.monitoring?.recordNotificationEvent("token_registered", {
      userId,
      app: dto.app
    });
    return { ok: true };
  }

  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    const tokens = await this.pushTokenRepository.find({
      where: { userId }
    });

    this.monitoring?.recordNotificationEvent("send_to_user", {
      userId,
      tokenCount: tokens.length,
      type: message.data?.type
    });
    await this.sendToTokens(tokens, message);
  }

  async sendToUsers(userIds: string[], message: PushMessage): Promise<void> {
    const uniqueUserIds = [...new Set(userIds)];
    this.monitoring?.recordNotificationEvent("send_to_users", {
      userCount: uniqueUserIds.length,
      type: message.data?.type
    });

    await Promise.all(uniqueUserIds.map((userId) => this.sendToUser(userId, message)));
  }

  private async sendToTokens(tokens: PushToken[], message: PushMessage): Promise<void> {
    const expoTokens = tokens
      .map((token) => token.token)
      .filter((token) => token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));

    if (!expoTokens.length) {
      return;
    }

    const payload = expoTokens.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
      sound: "default"
    }));

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      this.monitoring?.recordNotificationEvent("expo_push_sent", {
        tokenCount: expoTokens.length,
        type: message.data?.type
      });
    } catch {
      this.monitoring?.recordNotificationEvent("expo_push_failed", {
        tokenCount: expoTokens.length,
        type: message.data?.type
      });
      // Push delivery is best-effort; order state remains the source of truth.
    }
  }
}
