import { BadRequestException, Injectable } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

@Injectable()
export class S3Service {
  private client?: S3Client;
  private bucket?: string;
  private publicBaseUrl?: string;

  private getClient() {
    if (this.client && this.bucket && this.publicBaseUrl) {
      return this.client;
    }

    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION ?? "ru-1";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const bucket = process.env.S3_BUCKET;
    const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
      throw new BadRequestException("S3 не настроен");
    }

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey
      },
      forcePathStyle: true
    });
    this.bucket = bucket;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");

    return this.client;
  }

  async uploadPublic(key: string, buffer: Buffer, contentType: string) {
    const client = this.getClient();
    if (!this.bucket || !this.publicBaseUrl) {
      throw new BadRequestException("S3 не настроен");
    }

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read"
      })
    );

    return `${this.publicBaseUrl}/${key}`;
  }
}
