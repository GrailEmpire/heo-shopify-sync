import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const HEO_USERNAME = process.env.HEO_USERNAME;
const HEO_PASSWORD = process.env.HEO_PASSWORD;
const HEO_MANUFACTURER_ID = process.env.HEO_MANUFACTURER_ID;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

// Autenticação básica Heo
const heoApi = axios.create({
  baseURL: 'https://integrate.heo.com/retailer-api/v1',
  auth: {
    username: HEO_USERNAME,
    password: HEO_PASSWORD
  }
});

// Autenticação Shopify
const shopifyApi = axios.create({
  baseURL: `https://${SHOPIFY_STORE}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_TOKEN,
    'Content-Type': 'application/json'
  }
});

export async function syncProducts() {
  try {
    // Buscar produtos da Heo da marca Hasbro
    const { data } = await heoApi.get(`/catalog/products?query=manufacturer==${HEO_MANUFACTURER_ID}`);
    const products = data.content || [];

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const product of products) {
      try {
        const sku = product.productNumber;
        const name = product.name?.en || 'No Name';
        const description = product.description?.en || '';
        const image = product.media?.mainImage?.url;
        const priceInfo = product.prices?.suggestedRetailerPricePerUnit;
        const availability = product.availabilityState;
        const isPreorder = availability === 'PREORDER';

        if (!priceInfo || !priceInfo.amount) continue;

        const price = (parseFloat(priceInfo.amount) - 1).toFixed(2);

        const payload = {
          product: {
            title: name + (isPreorder ? ' [Pré-venda]' : ''),
            body_html: description,
            vendor: 'Heo',
            tags: isPreorder ? ['pre-order'] : [],
            variants: [
              {
                sku,
                price,
                inventory_management: 'shopify',
                inventory_quantity: 0,
                inventory_policy: 'continue' // permitir compras com stock 0 (pré-venda)
              }
            ],
            images: image ? [{ src: image }] : []
          }
        };

        // Tenta encontrar o produto existente por SKU
        const search = await shopifyApi.get(`/products.json?fields=id,title,variants`);
        const existing = search.data.products.find(p =>
          p.variants.some(v => v.sku === sku)
        );

        if (existing) {
          const variantId = existing.variants.find(v => v.sku === sku).id;
          await shopifyApi.put(`/variants/${variantId}.json`, {
            variant: { id: variantId, price }
          });
          updated++;
        } else {
          await shopifyApi.post(`/products.json`, payload);
          created++;
        }
      } catch (err) {
        console.error('Erro ao processar produto:', err.message);
        errors++;
      }
    }

    return { created, updated, errors, totalFromHeo: products.length };
  } catch (err) {
    console.error('Erro ao sincronizar produtos:', err.message);
    return { created: 0, updated: 0, errors: 1, totalFromHeo: 0 };
  }
}
