#!/bin/sh

set -e

if [ "${MIGRAR_NO_BOOT:-1}" = "1" ]; then
  tentativas="${MIGRAR_TENTATIVAS:-5}"
  espera="${MIGRAR_ESPERA:-5}"
  n=1

  while :; do
    echo "Aplicando migrations (tentativa $n de $tentativas)…"
    if saida=$(prisma migrate deploy 2>&1); then
      echo "$saida"
      break
    fi
    echo "$saida" >&2

    case "$saida" in
      *P3[0-9][0-9][0-9]*)
        echo "Erro na própria migration — nova tentativa não resolve." >&2
        exit 1
        ;;
    esac

    if [ "$n" -ge "$tentativas" ]; then
      echo "Migrations falharam $n vezes; a API não vai subir." >&2
      exit 1
    fi

    echo "Nova tentativa em ${espera}s…" >&2
    sleep "$espera"
    n=$((n + 1))
    espera=$((espera * 2))
    [ "$espera" -gt 30 ] && espera=30
  done
fi

exec "$@"
