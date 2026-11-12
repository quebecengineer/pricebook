/**
 * Category tree, parents before children, at most 3 levels (group > category > variant).
 * Ids are stable: overrides store them. Terms are lowercase singular phrases; plurals and accents
 * are folded when matching. Generic or brand-prone words ("fresh", "organic", "dairy", "fruit") are
 * never terms: an unknown category beats a wrong one.
 */
export const TAXONOMY: readonly (readonly [id: string, name: string, parent: string, terms: string])[] = [
  ['dairy', 'Dairy', '', ''],
  ['milk', 'Milk', 'dairy', 'milk, doodh'],
  ['flavoured-milk', 'Flavoured Milk', 'milk', 'chocolate milk, flavoured milk, flavored milk, milkshake, milk shake'],
  ['milk-powder', 'Milk Powder', 'milk', 'milk powder, dairy whitener'],
  ['plant-milk', 'Plant Milk', 'dairy', 'almond milk, soy milk, soya milk, oat milk, rice milk, cashew milk, coconut milk'],
  ['condensed-milk', 'Condensed Milk', 'dairy', 'condensed milk, milkmaid'],
  ['yogurt', 'Yogurt', 'dairy', 'yogurt, yoghurt, yogourt, curd, dahi'],
  ['greek-yogurt', 'Greek Yogurt', 'yogurt', 'greek yogurt, greek yoghurt, greek style yogurt, skyr, hung curd'],
  ['buttermilk', 'Buttermilk & Lassi', 'dairy', 'buttermilk, butter milk, chaas, chhaas, chaach, lassi'],
  ['paneer', 'Paneer', 'dairy', 'paneer, cottage cheese'],
  ['cheese', 'Cheese', 'dairy', 'cheese, cheddar, mozzarella, parmesan, gouda, feta'],
  ['butter', 'Butter', 'dairy', 'butter, makhan'],
  ['ghee', 'Ghee', 'dairy', 'ghee'],
  ['cream', 'Cream', 'dairy', 'cream, malai'],

  ['bakery', 'Bakery', '', ''],
  ['bread', 'Bread', 'bakery', 'bread, pav, loaf, bun, baguette'],
  ['cake', 'Cakes', 'bakery', 'cake, cupcake, muffin, brownie, brownies'],
  ['biscuits', 'Biscuits & Cookies', 'bakery', 'biscuit, cookie, cookies, cracker, rusk, khari, marie'],

  ['staples', 'Staples', '', ''],
  ['rice', 'Rice', 'staples', 'rice, basmati, chawal, sona masoori, kolam'],
  ['poha', 'Poha', 'staples', 'poha, flattened rice, beaten rice'],
  ['flour', 'Flour & Atta', 'staples', 'atta, flour, maida, besan, sooji, suji, rava, semolina'],
  ['dal', 'Dal & Pulses', 'staples', 'dal, daal, dhal, lentil, toor, tur, arhar, moong, mung, masoor, urad, rajma, kidney bean, chickpea, chana, chole, lobia, pulse'],
  ['noodles', 'Noodles & Pasta', 'staples', 'noodle, pasta, maggi, macaroni, spaghetti, penne, vermicelli, sevai'],
  ['oil', 'Cooking Oil', 'staples', 'oil'],
  ['sugar', 'Sugar & Jaggery', 'staples', 'sugar, jaggery, gur, shakkar, mishri'],
  ['salt', 'Salt', 'staples', 'salt, namak, sendha namak, rock salt'],
  ['spices', 'Spices & Masala', 'staples', 'masala, spice, haldi, turmeric, chilli, chili, chillies, chilies, mirchi, jeera, cumin, dhania, coriander powder, pepper, black pepper, cardamom, elaichi, clove, cinnamon, hing, asafoetida, ajwain, mustard seed, methi, kasuri methi, chicken masala, meat masala, fish masala, chana masala, pav bhaji masala, sambar masala, biryani masala, kitchen king'],
  ['baking', 'Baking', 'staples', 'baking soda, baking powder, yeast, cocoa powder, custard powder, cornstarch, essence'],
  ['dry-fruits', 'Nuts & Dry Fruits', 'staples', 'almond, badam, cashew, kaju, walnut, akhrot, pista, pistachio, raisin, kishmish, date, khajur, peanut, groundnut, moongphali, fig, anjeer, makhana'],

  ['snacks', 'Snacks & Sweets', '', ''],
  ['chips', 'Chips', 'snacks', 'chip, crisp, wafer, nacho, popcorn'],
  ['namkeen', 'Namkeen', 'snacks', 'namkeen, bhujia, mixture, sev, chakli, mathri, khakhra'],
  ['chocolate', 'Chocolate', 'snacks', 'chocolate, dairy milk, milk chocolate, dark chocolate, chocolate chip, kitkat, kit kat, munch, bournville'],
  ['sweets', 'Sweets', 'snacks', 'mithai, rasgulla, gulab jamun, laddu, ladoo, barfi, soan papdi'],

  ['beverages', 'Beverages', '', ''],
  ['tea', 'Tea', 'beverages', 'tea, chai'],
  ['coffee', 'Coffee', 'beverages', 'coffee, nescafe, bru, espresso'],
  ['juice', 'Juice', 'beverages', 'juice, nectar, frooti, maaza'],
  ['soft-drinks', 'Soft Drinks', 'beverages', 'cola, soda, soft drink, coke, pepsi, sprite, fanta, thums up, limca, 7up, mountain dew, energy drink, red bull'],
  ['water', 'Water', 'beverages', 'water, bisleri'],
  ['health-drinks', 'Health Drinks', 'beverages', 'horlicks, bournvita, boost, complan, protein powder, whey'],

  ['breakfast', 'Breakfast', '', ''],
  ['cereal', 'Cereal', 'breakfast', 'cereal, cornflake, corn flake, muesli, granola, chocos'],
  ['oats', 'Oats', 'breakfast', 'oat, oatmeal, rolled oat'],

  ['produce', 'Fruits & Vegetables', '', ''],
  ['fruits', 'Fruits', 'produce', 'apple, banana, kela, mango, aam, orange, santra, grape, papaya, pineapple, watermelon, muskmelon, melon, guava, pomegranate, anar, strawberry, kiwi, pear, lemon, nimbu, lime, chikoo, sapota, litchi, lychee, plum, peach, cherry, blueberry, avocado, coconut, custard apple'],
  ['vegetables', 'Vegetables', 'produce', 'potato, aloo, onion, pyaz, tomato, tamatar, carrot, gajar, cabbage, cauliflower, gobi, brinjal, baingan, eggplant, okra, bhindi, lady finger, ladyfinger, spinach, palak, pea, matar, cucumber, kheera, capsicum, bell pepper, bean, french bean, garlic, lahsun, ginger, adrak, green chilli, green chillies, coriander, mint, pudina, pumpkin, bottle gourd, lauki, bitter gourd, karela, radish, mooli, beetroot, mushroom, corn, sweet corn, sweet potato, broccoli, lettuce, zucchini, drumstick'],

  ['meat-eggs', 'Meat, Fish & Eggs', '', ''],
  ['eggs', 'Eggs', 'meat-eggs', 'egg, anda'],
  ['chicken', 'Chicken', 'meat-eggs', 'chicken, broiler'],
  ['mutton', 'Mutton', 'meat-eggs', 'mutton, lamb, goat meat'],
  ['fish', 'Fish & Seafood', 'meat-eggs', 'fish, prawn, shrimp, rohu, pomfret, surmai, salmon, tuna'],

  ['condiments', 'Sauces & Spreads', '', ''],
  ['sauces', 'Sauces & Ketchup', 'condiments', 'sauce, ketchup, chutney, mayonnaise, mayo, vinegar, schezwan'],
  ['pickle', 'Pickle', 'condiments', 'pickle, achar, achaar'],
  ['jam', 'Jam', 'condiments', 'jam, jelly, marmalade'],
  ['honey', 'Honey', 'condiments', 'honey'],
  ['spreads', 'Spreads', 'condiments', 'peanut butter, nutella, chocolate spread, hazelnut spread'],

  ['frozen', 'Frozen', '', ''],
  ['ice-cream', 'Ice Cream', 'frozen', 'ice cream, icecream, kulfi, frozen dessert, gelato, sorbet'],

  ['household', 'Household', '', ''],
  ['detergent', 'Detergent', 'household', 'detergent, washing powder, fabric conditioner, surf, ariel, tide, rin'],
  ['dishwash', 'Dishwash', 'household', 'dishwash, dish wash, dishwashing, dish soap, vim'],
  ['cleaners', 'Cleaners', 'household', 'cleaner, floor cleaner, toilet cleaner, harpic, lizol, colin, phenyl, bleach, disinfectant'],
  ['paper', 'Tissues & Paper', 'household', 'tissue, toilet paper, toilet roll, napkin, kitchen towel, paper towel'],
  ['bags', 'Garbage Bags', 'household', 'garbage bag, trash bag, dustbin bag'],

  ['personal-care', 'Personal Care', '', ''],
  ['soap', 'Soap & Body Wash', 'personal-care', 'soap, body wash, shower gel, handwash, hand wash, sanitizer, sanitiser'],
  ['hair-care', 'Hair Care', 'personal-care', 'shampoo, conditioner, hair oil, hair gel'],
  ['oral-care', 'Oral Care', 'personal-care', 'toothpaste, tooth paste, toothbrush, tooth brush, mouthwash, dental floss'],
  ['skin-care', 'Skin Care', 'personal-care', 'face cream, cold cream, lotion, body lotion, moisturiser, moisturizer, face wash, sunscreen, talc, talcum'],
  ['hygiene', 'Hygiene', 'personal-care', 'sanitary pad, sanitary napkin, diaper, razor, shaving cream, deodorant, deo'],
]

/** Often a flavor or descriptor ("Greek Yogurt Mango"), so these lose to any other match in the name. */
export const WEAK: ReadonlySet<string> = new Set(['fruits', 'vegetables', 'spices', 'chocolate', 'dry-fruits', 'honey', 'sugar', 'salt'])
