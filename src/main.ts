import './styles/index.css';
import { createApp } from './app';
import { failLoader } from './ui/loader';

createApp().catch((error: unknown) => {
  console.error('[boot]', error);
  failLoader(
    error instanceof Error
      ? error.message
      : '请确认浏览器已启用 WebGL，然后刷新页面重试。',
  );
});
