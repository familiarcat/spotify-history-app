# Build stage
FROM node:18 AS builder

WORKDIR /app
COPY package*.json ./
COPY . .

RUN npm install
RUN npx expo export:web

# Production stage
FROM nginx:alpine

# Copy the built web files
COPY --from=builder /app/web-build /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]