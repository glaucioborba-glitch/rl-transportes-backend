#!/bin/bash
cd apps/backend
npm install
npx prisma generate
npm run start:dev
