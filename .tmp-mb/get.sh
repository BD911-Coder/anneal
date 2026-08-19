curl -s --compressed --max-time 30 \
 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
 -H "Accept: text/html,application/xhtml+xml,*/*;q=0.8" -H "Accept-Language: en-US,en;q=0.9" \
 -H "Sec-Fetch-Dest: document" -H "Sec-Fetch-Mode: navigate" -H "Sec-Fetch-Site: none" "$1"
