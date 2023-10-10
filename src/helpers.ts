import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';

export function ffmpeg(
  args: (string | number)[],
  output: string
): Promise<undefined | Buffer> {
  const ffmpeg = spawn(
    ffmpegPath as any,
    [...args.map(arg => arg.toString()), output],
    { stdio: 'pipe' }
  );
  const buffers: Buffer[] = [];

  if (output === '-') {
    ffmpeg.stdout.on('data', data => buffers.push(data));
  }

  return new Promise(resolve => {
    ffmpeg.on('close', async () => {
      if (output !== '-') {
        resolve(undefined);
      } else {
        resolve(Buffer.concat(buffers));
      }
    });
  });
}

export async function frame(
  input: string,
  time: number,
  width: number,
  height: number
): Promise<Buffer> {
  const args: string[] = [];
  args.push('-ss', `${time}ms`);
  args.push('-i', input);
  args.push('-vf', `scale=${width}x${height}`);
  args.push('-frames:v', '1');
  args.push('-vsync', '0');
  args.push('-c:v', 'bmp');
  args.push('-an');
  args.push('-sn');
  args.push('-f', 'image2pipe');
  return (await ffmpeg(args, '-')) as Buffer;
}

export async function audio(input: string): Promise<Buffer> {
  const args: string[] = [];
  args.push('-i', input);
  args.push('-vn');
  args.push('-sn');
  args.push('-ac', '2');
  args.push('-ar', '44100');
  args.push('-acodec', 'pcm_s16le');
  args.push('-f', 's16le');
  return (await ffmpeg(args, '-')) as Buffer;
}
