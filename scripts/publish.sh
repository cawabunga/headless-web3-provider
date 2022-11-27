#!/bin/sh

rm -rf ./dist/*
yarn -s build
yarn -s publish
git push --tags
git push
