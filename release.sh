#!/usr/bin/env bash
git add ./ && git commit -m 'update version' && git push
npm run release