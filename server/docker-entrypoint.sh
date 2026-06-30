#!/bin/sh
set -e

npm run db:deploy --workspace server
exec npm start --workspace server
