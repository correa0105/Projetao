import type { EquipmentMetadata } from '../shared/equipment-target.js';
import sharp from 'sharp';
import { AppError } from './services.js';
export function trustedEquipmentPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    (/^\/[a-zA-Z0-9/_-]+\.(png|webp|jpg|jpeg)$/.test(path) ||
      /^\/shop\/magic-skins\/[a-z0-9-]+\.svg$/.test(path))
  );
}
export async function rasterizeEquipmentArt(bytes: Buffer, path: string) {
  if (!path.endsWith('.svg')) return bytes;
  if (!trustedEquipmentPath(path) || bytes.length > 8 * 1024 * 1024)
    throw new AppError(400, 'Referência de equipamento inválida.');
  const text = bytes.toString('utf8');
  if (
    /<(?:script|foreignObject)\b|<!DOCTYPE|<!ENTITY|(?:xlink:)?href\s*=\s*["'](?!data:image\/(?:png|webp|jpeg);base64,|#)/i.test(
      text,
    ) ||
    [...text.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(
      (match) => !match[2].trim().startsWith('#'),
    )
  )
    throw new AppError(
      400,
      'A referência de equipamento deve conter apenas recursos locais incorporados.',
    );
  try {
    return await sharp(bytes, { limitInputPixels: 40_000_000 }).png().toBuffer();
  } catch {
    throw new AppError(400, 'A referência de equipamento não é uma imagem válida.');
  }
}
export function equipmentArtReference(item: {
  name: string;
  image_path: string | null;
  raw_data?: EquipmentMetadata | null;
}) {
  const raw = item.raw_data;
  const path = trustedEquipmentPath(item.image_path)
    ? item.image_path
    : raw?.armor_bundle_model_image;
  let name = raw?.armor_piece_name || item.name;
  if (raw?.armor_complete === true && raw?.equipment_target === 'mount')
    name =
      item.name +
      ' [Armadura completa da montaria: reproduza toda a barda desta referência, incluindo todas as suas proteções. Combine com os acessórios equipados nas outras posições.]';
  if (raw?.piece_slot && path === raw.armor_bundle_model_image)
    name += ` [A imagem mostra o modelo completo do conjunto. Reproduza somente a peça desta posição: ${raw.piece_slot}; mantenha o material e acabamento. Não vestir as outras partes do conjunto por causa desta referência.]`;
  return { path, name };
}
