import type { Item } from './types';
import type { ShopItemGroup } from './shop-variants';

/** Shelf presentation only: preserve the catalog record and real purchase identity. */
export function shopCategoryName(category: string) {
  return category === 'Equipamento de montaria' ? 'Equipamentos de montaria' : category;
}

export function shopCategory(item: Pick<Item, 'id' | 'category'>) {
  return item.id === 'saddle-riding' || item.id === 'saddle-military'
    ? 'Equipamentos de montaria'
    : shopCategoryName(item.category);
}

export function shopOfferCategories(offer: ShopItemGroup) {
  return { ...offer, categories: [...new Set(offer.variants.map(shopCategory))] };
}
