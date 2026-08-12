const manualAliases = new Map<string, { key: string; displayName: string }>([
  ["녑비 주", { key: "joon-kim", displayName: "Joon Kim" }],
  ["joon kim", { key: "joon-kim", displayName: "Joon Kim" }],
]);

const normalizedLabel = (value: string) => value.trim().toLocaleLowerCase();

const fallbackHash = (value: string) => {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.codePointAt(0)!) | 0;
  }
  return Math.abs(hash).toString(36);
};

export const resolveMemberIdentity = (ownerName: string) => {
  const normalized = normalizedLabel(ownerName);
  const alias = manualAliases.get(normalized);
  if (alias) {
    return {
      canonicalKey: alias.key,
      displayName: alias.displayName,
      mappingMethod: "manual" as const,
    };
  }

  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return {
    canonicalKey: slug || `member-${fallbackHash(normalized)}`,
    displayName: ownerName.trim(),
    mappingMethod: "provider_claim" as const,
  };
};

export const syntheticOwnerExternalId = (ownerName: string) =>
  `owner-name:${normalizedLabel(ownerName)}`;
