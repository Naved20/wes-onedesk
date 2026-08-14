import urllib.request
import sys

url = "https://get.enterprisedb.com/postgresql/postgresql-17.0-1-windows-x64-binaries.zip"
try:
    print("Testing URL...")
    req = urllib.request.Request(url, method="HEAD")
    response = urllib.request.urlopen(req)
    print("URL is valid:", response.status)
except Exception as e:
    print("URL failed:", e)
