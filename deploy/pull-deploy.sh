#!/bin/sh
set -eu

# Publica em produção a revisão mais recente do repositório e reexecuta o deploy.
#
#   cd /opt/leiprova && ./deploy/pull-deploy.sh            # publica origin/main
#   cd /opt/leiprova && ./deploy/pull-deploy.sh <ref>      # publica uma ref específica
#
# Recusa-se a rodar se houver alteração local não commitada, para que uma
# correção feita direto no servidor nunca seja apagada em silêncio.

REF="${1:-origin/main}"

if [ ! -d .git ]; then
  echo "erro: $(pwd) não é um repositório git." >&2
  echo "Faça a migração descrita em README.md antes de usar este script." >&2
  exit 1
fi

if ! git diff --quiet HEAD 2>/dev/null; then
  echo "erro: há alterações locais não commitadas em $(pwd)." >&2
  git status --short >&2
  echo "Reverta com 'git checkout -- <arquivo>' ou leve a correção para o repositório." >&2
  exit 1
fi

antes="$(git rev-parse --short HEAD)"
echo "revisão atual: ${antes}"

git fetch --prune origin
git merge --ff-only "${REF}"

depois="$(git rev-parse --short HEAD)"
if [ "${antes}" = "${depois}" ]; then
  echo "nenhuma revisão nova; reexecutando o deploy assim mesmo."
else
  echo "atualizado para ${depois}:"
  git --no-pager log --oneline "${antes}..${depois}"
fi

./deploy/deploy.sh

echo
echo "publicado: $(git --no-pager log -1 --format='%h %s')"
