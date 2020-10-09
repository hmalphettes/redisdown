docker build -t password-protected-redis .
docker run -p 6379:6379 -d password-protected-redis