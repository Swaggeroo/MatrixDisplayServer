# Matrix Display Server

## Matrix Display
This repo is part of the Matrix Display Stack

Site: https://github.com/Swaggeroo/MatrixDisplaySite \
Server: https://github.com/Swaggeroo/MatrixDisplayServer \
ESP: https://github.com/Swaggeroo/MatrixESP32

## Site
This is the Backend of the Matrix Display

### Features
- Managing Pictures/GIF
  - Add
  - Remove
- Converting into usable format
- Communicating with ESP (Applying images)

## Deploy

### Ports
`3000`

### Environment Variables

#### Debug
`DEBUG=app:*`

#### Database
`MONGO_USER`
`MONGO_PASS`
`MONGO_URL`

#### Server
`MATRIX_URL`
`BASE_URL`

### Mounts
`/app/images`
