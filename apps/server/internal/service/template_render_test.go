package service

import "testing"

func TestLookupPathSupportsBracketArraySyntax(t *testing.T) {
	value := map[string]any{
		"codes": []any{"CODE-001", "CODE-002"},
		"data": map[string]any{
			"items": []any{
				map[string]any{
					"name": "Starter",
				},
			},
		},
	}

	code, ok := lookupPath(value, "codes[0]")
	if !ok || code != "CODE-001" {
		t.Fatalf("expected codes[0] lookup to resolve, got ok=%v value=%#v", ok, code)
	}

	name, ok := lookupPath(value, "data.items[0].name")
	if !ok || name != "Starter" {
		t.Fatalf("expected nested bracket lookup to resolve, got ok=%v value=%#v", ok, name)
	}
}

func TestRenderTemplateStringSupportsBracketArraySyntax(t *testing.T) {
	rendered := renderTemplateString("Code: {{codes[0]}}", map[string]any{
		"codes": []any{"CODE-001"},
	})

	if rendered != "Code: CODE-001" {
		t.Fatalf("expected bracket array syntax to render, got %#v", rendered)
	}
}
