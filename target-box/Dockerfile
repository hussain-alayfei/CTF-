# Optional: run the Day 4 target box in a container instead of bare Python.
#   docker build -t kgsp-day4-box target-box
#   docker run --rm -p 8021:8021 -p 8080:8080 -p 8053:8053/udp kgsp-day4-box
FROM python:3.12-slim
WORKDIR /app
COPY server.py .
EXPOSE 8021 8080 8053/udp
CMD ["python", "server.py"]
