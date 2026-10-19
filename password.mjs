import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { passwordHash } from './server.mjs';
if(!process.stdin.isTTY)throw Error('Run interactively in a terminal');
let muted=false;
const output=new Writable({write(chunk,enc,cb){if(!muted)process.stdout.write(chunk);cb()}});
const rl=createInterface({input:process.stdin,output,terminal:true});
process.stdout.write('New admin password (minimum 12 characters, hidden): ');muted=true;
rl.question('',password=>{rl.close();process.stdout.write('\n');if(password.length<12||password.length>256){console.error('Password must be 12–256 characters');process.exitCode=1;return}console.log('Set ADMIN_PASSWORD_HASH in your hosting dashboard:\n'+passwordHash(password))});
