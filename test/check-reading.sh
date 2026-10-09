#!/bin/bash
# Reading Room API check (run via with-server.sh). Expects the fake GLP pack
# from make-fake-pack.py in DEV_METADATA_DIR; DOSMagazines.zip absent.
B=http://localhost:8090
call() { /usr/bin/curl -s -m 30 -H 'Remote-User: smii' -H 'Content-Type: application/json' -X POST -d "$2" "$B/api/invoke/$1"; }
js() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log($1)})"; }

echo "publications: $(call list_publications '{}' | js 'j.length')"
echo "magazines:    $(call list_issues '{"kind":"magazine"}' | js 'j.length')"
ASM=$(call list_issues '{"query":"ASM 1986-03"}' | js 'j[0].key')
echo "ASM 1986-03:  key=$ASM"
call open_issue "{\"key\":\"$ASM\"}" | js '`open (fake GLP pack): phase=${j.phase} path=${j.path}`'
P=$(call get_issue_status "{\"key\":\"$ASM\"}" | js 'j.path')
/usr/bin/curl -s -m 10 -H 'Remote-User: smii' -o /tmp/reading.pdf -w "asset: %{http_code} %{content_type} %{size_download} bytes\n" "$B/asset?path=$(node -e "console.log(encodeURIComponent('$P'))")"
/usr/bin/head -c 8 /tmp/reading.pdf; echo
OTHER=$(call list_issues '{"query":"Red Herring"}' | js 'j.find(i=>!i.runnable).key')
call open_issue "{\"key\":\"$OTHER\"}" | js '`open (no Media Pack): phase=${j.phase} error=${j.error}`'
echo "cache index:  $(call reading_cache_index '{}' | js 'j.join(",")')"
ID=$(call get_games '{"query":"Wing Commander","limit":1}' | js '(j.games ?? j)[0]?.id')
echo "Wing Commander ($ID) covered in: $(call game_articles "{\"id\":$ID}" | js 'j.length + " articles, e.g. " + (j[0] ? j[0].publication + " " + j[0].issue_title + " p" + j[0].page : "-")')"
call set_issue_favorited "{\"key\":\"$ASM\",\"favorited\":true}" >/dev/null
echo "favourited:   $(call get_issue "{\"key\":\"$ASM\"}" | js 'j.favorited')"
