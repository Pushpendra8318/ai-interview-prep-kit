import mongoose from 'mongoose';

let connected = false;

export async function connectDb(uri: string): Promise<typeof mongoose> {
  if (connected && mongoose.connection.readyState === 1) {
    return mongoose;
  }
  await mongoose.connect(uri);
  connected = true;
  return mongoose;
}

export async function disconnectDb(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
