import path from 'path';
import Speaker from 'speaker';
import { mkdir, readdir, rm } from 'fs/promises';
import { spawn } from 'child_process';
import { runAppleScript } from 'run-applescript';
import { decode } from 'bmp-js';
import { createServer } from 'net';

import { audio, frame } from './helpers.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const bufferRoot = path.join(process.cwd(), 'dirs');

const buffers = ['a', 'b'];

const script = `
${buffers
  .map(
    buffer =>
      `tell application "Finder" to set target of front Finder window to ("${path.join(
        bufferRoot,
        buffer
      )}" as POSIX file)`
  )
  .join('\n')}
tell application "Finder" to tell front window to update every item

set curBuf to "a"
repeat while curBuf ≠ "_"
    set curBuf to do shell script "cd ${process.cwd()}; node ./build/frame.js"
    tell application "Finder" to set target of front Finder window to ("${bufferRoot}/" & curBuf as POSIX file)
end repeat
`;

async function main(file: string, width: number, height: number) {
  let currentBuffer = 'b';
  let startedAt = new Date().getTime();

  async function emptyBuffer(buffer: string) {
    const bufferPath = path.join(bufferRoot, buffer);
    const files = await readdir(bufferPath);
    for (const file of files) {
      if (file.startsWith('.')) {
        continue;
      }

      await rm(path.join(bufferPath, file), { recursive: true, force: true });
    }
  }

  async function renderFrame() {
    const time = new Date().getTime() - startedAt;
    console.log('[PLAY]', 'Rendering frame at:', time, 'ms');
    await emptyBuffer(currentBuffer);
    const bufferPath = path.join(bufferRoot, currentBuffer);
    try {
      const currentFrame = await frame(file, time, width, height);
      const decoded = decode(currentFrame);
      for (let y = 0; y < decoded.height; y++) {
        let name = `${y}`;

        for (let x = 0; x < decoded.width; x++) {
          const idx = (y * decoded.width + x) * 4;
          const b = decoded.data.at(idx + 1);
          const g = decoded.data.at(idx + 2);
          const r = decoded.data.at(idx + 3);
          if (b > 128) {
            name += '⬜️';
          } else {
            name += '⬛';
          }
        }

        mkdir(path.join(bufferPath, name));
      }
    } catch {}
  }

  function nextFrame() {
    if (currentBuffer === 'a') {
      currentBuffer = 'b';
    } else {
      currentBuffer = 'a';
    }

    renderFrame();
  }

  const server = createServer(socket => {
    socket.write(currentBuffer);
    nextFrame();
  });
  server.listen(9111, '127.0.0.1');

  console.log('[PREPARE]', 'Preparing video: ', file);
  console.log('[PREPARE]', 'Converting audio...');
  const audioBuffer = await audio(file);
  console.log('[PREPARE]', 'Audio converted...');
  console.log('[PREPARE]', 'Cleaning up buffers...');
  for (const buffer of buffers) {
    await emptyBuffer(buffer);
  }
  console.log('[PREPARE]', 'Buffer directories ready...');
  console.log('[PREPARE]', 'Loading first frame...');
  console.log('[PREPARE]', 'First frame loaded...');
  console.log('[PLAY]', 'Opening Finder...');
  const finder = spawn('open', [bufferRoot], {});
  console.log('[PLAY]', 'Finder ready...');

  finder.on('close', async () => {
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100,
    });
    speaker.end(audioBuffer);
    startedAt = new Date().getTime();
    await renderFrame();
    await runAppleScript(script);
    finder.kill();
  });
}

const args = yargs(hideBin(process.argv))
  .option('height', {
    alias: 'h',
    type: 'number',
    description: 'Height of output image',
    default: 32,
  })
  .option('width', {
    alias: 'w',
    type: 'number',
    description: 'Width of output image',
    default: 48,
  })
  .option('input', {
    alias: 'i',
    type: 'string',
    required: true,
  })
  .parseSync();

main(path.resolve(args.input), args.width, args.height);
