/** Shopping taxonomy only. Explicit file categories always take precedence.
 * Known IDs use a small offline catalogue; unknown IDs remain 'other'.
 * Neither ingredient names nor immutable source plans are rewritten.
 */
export const CATEGORY_IDS = {
  produce: ['apple','banana','pear','orange','mandarins','kiwi','lime','lemon','arugula','broccoli','carrots','cherry-tomatoes','eggplant','fennel','green-beans','lettuce','mushrooms','onion','potatoes','pumpkin','spinach','tomatoes','zucchini','bell-pepper','strawberries','blueberries','cucumber','garlic'],
  grains: ['oats','muesli','pasta','potato-gnocchi','rice','tortilla','whole-wheat-bread','whole-wheat-pasta','whole-wheat-piadina','whole-wheat-rice','whole-wheat-rusks','bread','brown-rice','quinoa','couscous'],
  protein: ['chicken-breast','cod-fillet','eggs','lean-beef','lentils-cooked','natural-tuna','prosciutto-cotto','salmon','sea-bream-fillet','turkey-breast','tofu','lentils','chickpeas','beans','tuna','egg'],
  dairy: ['parmesan','ricotta','semi-skimmed-milk','yogurt-greek-0','yogurt-white','milk','greek-yogurt','yogurt','mozzarella','feta','cottage-cheese'],
  pantry: ['almonds','hazelnuts','honey','jam','olive-oil','rice-vinegar','sesame-seeds','soy-sauce','tomato-passata','walnuts','salt','pepper','sugar','flour','peanut-butter']
};
const catalogue = new Map(Object.entries(CATEGORY_IDS).flatMap(([category, ids]) => ids.map(id => [id, category])));
export function ingredientCategory(ingredient) {
  if (typeof ingredient.category === 'string' && ingredient.category.trim()) return ingredient.category;
  return catalogue.get(ingredient.ingredientId) || 'other';
}
