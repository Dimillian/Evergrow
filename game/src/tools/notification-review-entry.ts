if (!import.meta.env.DEV) throw new Error('Local review only.');
if (new URLSearchParams(location.search).get('view') === 'banners') await import('./area-banner-review.ts');
else await import('../notifications-review.ts');
export {};
