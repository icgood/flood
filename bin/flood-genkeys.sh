#!/bin/bash

DIR=$1
if [ "x$DIR" = "x" ]; then
	DIR=/etc/flood
fi

mkdir -p $DIR
if [ $? -ne 0 ]; then
	exit 1
fi
cd $DIR

openssl genrsa -out private.pem 1024
openssl rsa -in private.pem -out public.pem -outform PEM -pubout

chmod 600 private.pem

