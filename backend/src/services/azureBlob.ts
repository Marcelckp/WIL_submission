import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCzY4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

const blobServiceClient =
  BlobServiceClient.fromConnectionString(connectionString);

export async function getContainerClient(
  containerName: string
): Promise<ContainerClient> {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({
    access: "blob", // Public read access
  });
  return containerClient;
}

export async function uploadBlob(
  containerName: string,
  blobName: string,
  data: Buffer,
  contentType?: string
): Promise<string> {
  const containerClient = await getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(data, data.length, {
    blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined,
  });

  // Return URL (use actual Azure URL or local dev URL)
  const baseUrl =
    process.env.AZURE_BLOB_BASE_URL ||
    `http://127.0.0.1:10000/devstoreaccount1/${containerName}`;
  return `${baseUrl}/${blobName}`;
}

export async function deleteBlob(
  containerName: string,
  blobName: string
): Promise<void> {
  const containerClient = await getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

export async function downloadBlob(
  containerName: string,
  blobName: string
): Promise<Buffer> {
  const containerClient = await getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const downloadResponse = await blockBlobClient.download();

  if (!downloadResponse.readableStreamBody) {
    throw new Error("Blob not found or empty");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function streamBlob(
  containerName: string,
  blobName: string
): Promise<NodeJS.ReadableStream> {
  const containerClient = await getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const downloadResponse = await blockBlobClient.download();

  if (!downloadResponse.readableStreamBody) {
    throw new Error("Blob not found or empty");
  }

  return downloadResponse.readableStreamBody;
}
