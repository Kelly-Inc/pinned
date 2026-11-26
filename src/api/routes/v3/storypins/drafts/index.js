// Pin builder drafts. Drafts are kept client-side; we just hand out ids.
export const post = () => ({ id: `draft-${Date.now()}`, type: 'storypindraft' });
export const get = () => [];
