#!/bin/sh

rm -rf ./dist/*
rm -rf ./.parcel-cache
yarn -s build
yarn -s publish
git push --tags
git push
