#!/bin/sh
set -eu

# Operação restrita: este arquivo nunca usa docker-compose.yml nem o .env real.
test "${LEIPROVA_QA_ACTIVATE:-}" = synthetic || { echo "Confirme LEIPROVA_QA_ACTIVATE=synthetic."; exit 1; }
test "$(pwd -P)" = /opt/leiprova || { echo "Execute somente em /opt/leiprova."; exit 1; }
qa_env=/opt/leiprova/.local/commerce/qa-persistente/.env
qa_accounts=/opt/leiprova/.local/commerce/qa-persistente/accounts.json
test -f "$qa_env" && test -f "$qa_accounts"
test "$(stat -c %a "$qa_env")" = 600
test "$(stat -c %a "$qa_accounts")" = 600
if ! getent ahostsv4 homolog.leiprova.2b.app.br | awk '$1 == "187.127.46.251" { found=1 } END { exit !found }'; then
  echo "DNS de homologação ainda não aponta diretamente para a VPS. Nada foi iniciado."
  exit 1
fi
if ! awk -F= '/^LEIPROVA_QA_(APP|TOOLS)_IMAGE=/ {
  if (NF != 2 || $2 !~ /^sha256:[0-9a-f]+$/ || length($2) != 71) invalid=1;
  if ($1 == "LEIPROVA_QA_APP_IMAGE") app++; else tools++;
} END { exit invalid || app != 1 || tools != 1 }' "$qa_env"; then
  echo "Fixe os dois IDs imutáveis das imagens aprovadas no arquivo privado de QA."
  exit 1
fi
qa_app_image=$(awk -F= '$1 == "LEIPROVA_QA_APP_IMAGE" { print $2 }' "$qa_env")
qa_build_profile=$(docker image inspect "$qa_app_image" --format '{{ index .Config.Labels "io.leiprova.build-profile" }}' 2>/dev/null) || {
  echo "Imagem de homologação ausente. Nada foi iniciado."
  exit 1
}
if test "$qa_build_profile" != qa; then
  echo "A imagem precisa ter sido compilada com LEIPROVA_BUILD_PROFILE=qa. Imagem de produção recusada; nada foi iniciado."
  exit 1
fi
qa_compose() { docker compose --env-file "$qa_env" -f /opt/leiprova/deploy/docker-compose.qa.yml "$@"; }
qa_compose config --quiet
qa_compose up -d db
qa_compose run --rm migrate
docker exec -i leiprova-qa-db psql -U leiprova_qa_owner -d leiprova_qa -v app_user=leiprova_qa_app < /opt/leiprova/deploy/grant-app-role.sql
qa_compose run --rm fixtures
qa_compose up -d app
echo "Somente leiprova-qa iniciado. Confirme HTTPS, banner, três logins e isolamento antes de entregar os acessos."
