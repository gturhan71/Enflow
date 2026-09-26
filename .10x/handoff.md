# Handoff
M2 tamam (branch feat/m2-pg-upgrade, PR base=feat/prod-runtime-pg-pipeline). Kritik bulgu: PG STATE yedeği sessizce hiç alınmıyordu (düzeltildi 49fef93).
Sıradaki M3 (branch M2 üstünden): T14 systemd/launchd şablonları + `install/lib/service.mjs` render · T15 WinSW (sabit sürüm+SHA256) · T16 wizard servis adımı · T17 dokümanlar · T18 release checklist · T19 RBAC+QA/Sec+sürüm kararı.
`install/lib/service.mjs` SERVICE sabitleri (enflow / com.enflow.backend / enflow-service.exe) şablon adlarıyla eşleşmeli.
Yerel PG: scratchpad/pgdata:55432 (LC_ALL=en_US.UTF-8, -k /private/tmp/claude-501/pgs). Upgrade deneme düzeneği: scratchpad/upg (remote.git, home, dev).
