// 预加载脚本 (ESM)
import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('jtwords', { version: '0.1.0' });
