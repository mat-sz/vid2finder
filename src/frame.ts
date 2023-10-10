import { Socket } from 'net';

const socket = new Socket();
socket.connect(9111, '127.0.0.1');
socket.on('data', data => {
  const ch = data.readUInt8();
  console.log(String.fromCharCode(ch));
  socket.destroy();
});
