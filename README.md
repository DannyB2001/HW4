# Shopping List API (HW4)

Node.js/Express REST API with uuCmd-style endpoints for shopping lists and items. HW4 upgrades the HW3 in-memory version to MongoDB with richer validation and error handling.

## What changed from HW3 to HW4
- MongoDB persistence via the official driver (`MONGO_URI`).
- New DB helper (`src/data/store.js`) replacing in-memory arrays; exposes DAOs for shoppingList, item, membership.
- Generic dtoIn validation middleware with unsupported-key warnings and `invalidDtoIn` errors; applies defaults.
- Every response returns `uuAppErrorMap`; domain errors/warnings are recorded there.
- Auth now uses header `x-user-id` and membership-based authorization (owner/member) per shopping list.
- Routes refactored to async/await with MongoDB; uuCmd names and dtoIn/dtoOut shapes stay compatible with HW3.

## How to run
1) Install deps: `npm install`
2) Start MongoDB:
   - Docker quick start: `docker run -d --name shopping-mongo -p 27017:27017 mongo:7`
   - Or docker-compose (optional):
     ```yaml
     version: "3.9"
     services:
       mongo:
         image: mongo:7
         restart: unless-stopped
         ports: ["27017:27017"]
         volumes: [ "mongo-data:/data/db" ]
         environment:
           MONGO_INITDB_DATABASE: shopping-list
     volumes:
       mongo-data:
     ```
     Run: `docker compose up -d`
3) Set Mongo URI (PowerShell example):
   - Current session: `$env:MONGO_URI="mongodb://localhost:27017/shopping-list"`
   - Persistent: `setx MONGO_URI "mongodb://localhost:27017/shopping-list"`
4) Start API: `npm start` (listens on `http://localhost:3000`)
5) Optional: set `AWID` env if you want to stamp documents with awid (defaults to null).

Insomnia collection is provided in `insomnia_collection.json` (import into Insomnia).

## Calling the API
- Base path `/`; required header: `x-user-id: <your-user>`.
- Responses always include `uuAppErrorMap` (warnings/errors).
- GET/DELETE accept dtoIn via query string; POST/PATCH use JSON body.

### Shopping list uuCmds
- `POST /shoppingList/create` — `{ name, description?, canMarkItemsDoneByAll? }` (owner auto-set)
- `POST` or `GET /shoppingList/listMine` — `{ state?, pageInfo?: { pageIndex?, pageSize? } }`
- `POST` or `GET /shoppingList/get` — `{ shoppingListId }` (owner|member)
- `POST` or `PATCH /shoppingList/update` — `{ shoppingListId, name?, description?, canMarkItemsDoneByAll?, state? }` (owner)
- `POST` or `DELETE /shoppingList/delete` — `{ shoppingListId }` (owner)
- `POST /shoppingList/addMember` — `{ shoppingListId, memberId, role? }` (owner)
- `POST` or `DELETE /shoppingList/removeMember` — `{ shoppingListId, memberId }` (owner)
- `POST` or `GET /shoppingList/listMembers` — `{ shoppingListId }` (owner|member)

### Item uuCmds
- `POST /item/create` — `{ shoppingListId, name, quantity?, note? }` (owner|member)
- `POST` or `GET /item/list` — `{ shoppingListId, done?, pageInfo?: { pageIndex?, pageSize? } }` (owner|member)
- `POST` or `PATCH /item/update` — `{ itemId, name?, quantity?, note? }` (owner|member)
- `POST` or `PATCH /item/markDone` — `{ itemId, done }` (owner|member; respects `canMarkItemsDoneByAll`)
- `POST` or `DELETE /item/delete` — `{ itemId }` (owner|member)

## Scenario descriptions
1) Create list → Add member → List members → Member adds items → Member marks done (if allowed).  
   - `/shoppingList/create` (owner) → `/shoppingList/addMember` (owner) → `/shoppingList/listMembers` → `/item/create` (member) → `/item/markDone`.
2) Owner-only maintenance flow.  
   - `/shoppingList/update` to change name/description/state → `/shoppingList/delete` to remove; owner permissions enforced.
3) Browsing and paging your lists and items.  
   - `/shoppingList/listMine` with `pageInfo` → pick `shoppingListId` → `/item/list` with `pageInfo` and optional `done` filter.
4) Membership cleanup.  
   - `/shoppingList/removeMember` removes a member; any subsequent item/list calls by that user will return 403.
