# Shopping List API (uuCmd demo)

Jednoduchá Node.js/Express aplikace imitující uuApp zadání: shopping listy, položky a členství nad in-memory úložištěm. Obsahuje validační middleware (Zod), autorizaci přes profily a vrací `uuAppErrorMap`.

## Spuštění
1. `npm install`
2. `npm start` (server na `http://localhost:3000`)

## Autentizace a profily
- `x-user-id`: identita volajícího (povinné)
- `x-profile`: profil musí odpovídat povoleným rolím endpointu (`user`, `owner`, `member`)

## Endpoints (uuCmd)
Base path: `/`

### Shopping list
- `POST /shoppingList/create` (profile `user`)  
  dtoIn: `{ name, description?, canMarkItemsDoneByAll? }`  
  dtoOut: `{ shoppingList, uuAppErrorMap }`

- `POST /shoppingList/listMine` (profile `user`)  
  dtoIn: `{ state?, pageInfo?: { pageIndex?, pageSize? } }`  
  dtoOut: `{ shoppingLists, pageInfo, uuAppErrorMap }`

- `POST /shoppingList/get` (profiles `owner|member|user` + členství)  
  dtoIn: `{ shoppingListId }`  
  dtoOut: `{ shoppingList, uuAppErrorMap }`

- `POST /shoppingList/update` (profile `owner`)  
  dtoIn: `{ shoppingListId, name?, description?, canMarkItemsDoneByAll?, state? }`  
  dtoOut: `{ shoppingList, uuAppErrorMap }`

- `POST /shoppingList/delete` (profile `owner`)  
  dtoIn: `{ shoppingListId }`  
  dtoOut: `{ shoppingListId, uuAppErrorMap }`

- `POST /shoppingList/addMember` (profile `owner`)  
  dtoIn: `{ shoppingListId, memberId, role? }`  
  dtoOut: `{ membership, uuAppErrorMap }` (warning pokud už existuje)

- `POST /shoppingList/removeMember` (profile `owner`)  
  dtoIn: `{ shoppingListId, memberId }`  
  dtoOut: `{ removed, uuAppErrorMap }`

- `POST /shoppingList/listMembers` (profiles `owner|member`)  
  dtoIn: `{ shoppingListId }`  
  dtoOut: `{ members, uuAppErrorMap }`

### Item
- `POST /item/create` (profiles `owner|member`)  
  dtoIn: `{ shoppingListId, name, quantity? }`  
  dtoOut: `{ item, uuAppErrorMap }`

- `POST /item/list` (profiles `owner|member`)  
  dtoIn: `{ shoppingListId, done?, pageInfo?: { pageIndex?, pageSize? } }`  
  dtoOut: `{ items, pageInfo, uuAppErrorMap }`

- `POST /item/update` (profiles `owner|member`)  
  dtoIn: `{ itemId, name?, quantity? }`  
  dtoOut: `{ item, uuAppErrorMap }`

- `POST /item/markDone` (profiles `owner|member`, respektuje `canMarkItemsDoneByAll`)  
  dtoIn: `{ itemId, done }`  
  dtoOut: `{ item, uuAppErrorMap }`

- `POST /item/delete` (profiles `owner|member`)  
  dtoIn: `{ itemId }`  
  dtoOut: `{ itemId, uuAppErrorMap }`

## In-memory úložiště
- `src/data/store.js` udržuje pole `shoppingLists`, `items`, `memberships` + helpery pro CRUD.
- Při vytvoření listu se zakládá owner membership; mazání listu smaže i jeho items/memberships.
- DTO používají `shoppingListId`/`itemId`/`memberId` v souladu s návrhem.

## Známá omezení
- Není perzistence do DB; restart procesu resetuje data.
- Autorizace vychází jen z hlaviček a in-memory membership, nikoli z externí identity/uuIdentity.
