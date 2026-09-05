import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

/** Type-only links do not impose initialization order; actual module edges do. */
function runtimeDependencies(file: string): string[] {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const dependencies: string[] = [];
  for (const statement of ast.statements) {
    if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement))
      || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.') || !specifier.endsWith('.ts')) continue;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      const bindings = clause?.namedBindings;
      if (clause && !clause.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.every(element => element.isTypeOnly)) continue;
    } else if (statement.isTypeOnly || (statement.exportClause && ts.isNamedExports(statement.exportClause)
      && statement.exportClause.elements.every(element => element.isTypeOnly))) continue;
    dependencies.push(resolve(dirname(file), specifier));
  }
  return dependencies;
}

test('runtime modules have no import cycles that couple construction order across systems', () => {
  const graph = new Map(readdirSync(sourceRoot).filter(name => name.endsWith('.ts')).map(name => {
    const file = resolve(sourceRoot, name); return [file, runtimeDependencies(file)] as const;
  }));
  const visited = new Set<string>(), active: string[] = [];
  const visit = (file: string) => {
    assert.ok(!active.includes(file), `Runtime cycle: ${[...active, file].map(name => basename(name)).join(' → ')}`);
    if (visited.has(file)) return;
    active.push(file);
    for (const dependency of graph.get(file) ?? []) visit(dependency);
    active.pop(); visited.add(file);
  };
  for (const file of graph.keys()) visit(file);
});

test('combat runtime dependencies remain inside the headless core compiler boundary', () => {
  const config = JSON.parse(readFileSync(new URL('../tsconfig.core.json', import.meta.url), 'utf8'));
  const allowed = new Set<string>(config.include.map((file: string) => resolve(sourceRoot, '..', file)));
  allowed.add(resolve(sourceRoot, 'model.ts')); allowed.add(resolve(sourceRoot, 'attack-motion.ts'));
  const visited = new Set<string>();
  const visit = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(allowed.has(file), `${basename(file)} must stay headless or be explicitly added to the core compiler check`);
    for (const dependency of runtimeDependencies(file)) visit(dependency);
  };
  visit(resolve(sourceRoot, 'simulation.ts'));
});
