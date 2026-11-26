// The suggested-stories strip above search results. Empty connection.
export const match = /SearchTabHandler/;
export const priority = 90;

export const resolve = () => ({
  v3SearchTabHandlerQuery: {
    __typename: 'V3SearchTabHandler',
    data: {
      __typename: 'V3SearchTabHandlerData',
      connection: {
        __typename: 'V3SearchTabHandlerDataConnection',
        edges: [],
        pageInfo: { __typename: 'PageInfo', endCursor: null, hasNextPage: false },
      },
    },
  },
});
