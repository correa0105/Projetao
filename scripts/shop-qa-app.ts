import express from 'express';
import { resolve } from 'node:path';

/** Read original public shop media directly during disposable-DB checks. */
export function shopQaApp(createApp: () => express.Express) {
  if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
    throw Error('Disposable database required for the shop preview adapter');
  const app = express();
  const root = resolve(process.env.SHOP_QA_PUBLIC_DIR || 'public');
  app.use('/shop', express.static(resolve(root, 'shop')));
  app.use('/audio/emporium', express.static(resolve(root, 'audio/emporium')));
  app.use(createApp());
  return app;
}
