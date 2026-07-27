// Calcula el próximo ID secuencial a partir del listado existente
function getNextId(items) {
  let maxId = 0;
  for (const item of items) {
    const num = parseInt(item.id, 10);
    if (!isNaN(num) && num > maxId) maxId = num;
  }
  return maxId + 1;
}

module.exports = { getNextId };
