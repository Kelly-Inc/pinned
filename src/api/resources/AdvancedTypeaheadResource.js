// Search-as-you-type suggestions. The typeahead reducer concatenates
// data.items; suggestions are not implemented yet, so it stays empty.
export const get = (ctx) => ({ items: [], query: String(ctx.options.term || '') });
