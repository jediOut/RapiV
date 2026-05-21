import { Injectable } from "@nestjs/common";

type QueueItem<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

@Injectable()
export class OrderProcessingQueue {
  private readonly concurrency = 4;
  private readonly pending: QueueItem<unknown>[] = [];
  private activeWorkers = 0;

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        task,
        resolve: resolve as (value: unknown) => void,
        reject
      });
      this.drain();
    });
  }

  private drain(): void {
    while (this.activeWorkers < this.concurrency && this.pending.length > 0) {
      const item = this.pending.shift();

      if (!item) {
        return;
      }

      this.activeWorkers += 1;
      void this.run(item);
    }
  }

  private async run<T>(item: QueueItem<T>): Promise<void> {
    try {
      item.resolve(await item.task());
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeWorkers -= 1;
      this.drain();
    }
  }
}
