import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { RecordService } from './record.service';

@Processor('record-queue')
export class RecordProcessor {
  constructor(private readonly recordService: RecordService) {}

  // One job per URL: reads stream and enqueues per-record jobs
  @Process({ name: 'sync-source' }) 
  async handleSyncSource(job: Job<{ url: string }>) {
    return this.recordService.syncSourceToJobs(job.data.url);
  }

  // Per-record ingestion with concurrency=150
  @Process({ name: 'ingest-one', concurrency: 150 })
  async handleIngestOne(job: Job<{ source: string; item: any }>) {
    await this.recordService.ingestRecord(job.data.source, job.data.item);
    return { ok: true };
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    if (job.name === 'sync-source') {
      console.log(`✅ sync-source completed (#${job.id})`);
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    console.error(`❌ ${job.name} (#${job.id}) failed: ${err.message}`);
  }
}
