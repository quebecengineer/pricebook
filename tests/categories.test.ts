import { describe, expect, it } from 'vitest'
import { CATEGORIES, categorize, categoryOf, searcher, stem, tokens } from '../src/categories'
import type { Item } from '../src/model'
import { TAXONOMY, WEAK } from '../src/taxonomy'

const item = (id: string, name: string, category?: string): Item => ({ id, name, unit: 'kg', updatedAt: 1, category })

describe('categorize', () => {
  it.each([
    ['Epigamia Greek Yogurt Mango 400g', 'greek-yogurt'],
    ['Nestle a+ Greek Yoghurt Strawberry', 'greek-yogurt'],
    ['Amul Masti Dahi 1kg', 'yogurt'],
    ['Mother Dairy Classic Curd', 'yogurt'],
    ['Amul Taaza Toned Milk 1L', 'milk'],
    ["Hershey's Chocolate Milk 200ml", 'flavoured-milk'],
    ['Cadbury Dairy Milk Silk', 'chocolate'],
    ['Amul Milk Chocolate', 'chocolate'],
    ['Britannia Milk Bread 400g', 'bread'],
    ['Coconut Milk 400ml', 'plant-milk'],
    ['So Good Almond Milk', 'plant-milk'],
    ['Lays Chips Classic Salted', 'chips'],
    ["Lay's Potato Chips Masala", 'chips'],
    ['Maggi 2-Minute Masala Noodles', 'noodles'],
    ['Everest Chicken Masala 100g', 'spices'],
    ['Red Chilli Powder', 'spices'],
    ['Green Chillies 100g', 'vegetables'],
    ['Fresho Chicken Breast Boneless', 'chicken'],
    ['Aashirvaad Whole Wheat Atta 5kg', 'flour'],
    ['India Gate Basmati Rice', 'rice'],
    ['Fortune Rice Bran Oil 1L', 'oil'],
    ['Tata Salt 1kg', 'salt'],
    ['Tata Sampann Toor Dal', 'dal'],
    ['Mango Pickle', 'pickle'],
    ['Alphonso Mangoes 1 dozen', 'fruits'],
    ['Tomatoes', 'vegetables'],
    ['Kissan Fresh Tomato Ketchup', 'sauces'],
    ['Chilli Sauce', 'sauces'],
    ['Pintola Peanut Butter Crunchy', 'spreads'],
    ['Amul Butter 500g', 'butter'],
    ['Amul Pure Ghee', 'ghee'],
    ['Real Fruit Power Orange Juice', 'juice'],
    ['Britannia Good Day Cookies', 'biscuits'],
    ['Parle-G Biscuits 800g', 'biscuits'],
    ['Chocolate Chip Cookies', 'biscuits'],
    ['Sugar Free Biscuits', 'biscuits'],
    ['Kwality Walls Chocolate Ice Cream', 'ice-cream'],
    ['Eggless Cake', 'cake'],
    ['Farm Eggs 30 pcs', 'eggs'],
    ['Raw Pressery Coconut Water', 'water'],
    ['Quaker Oats 1kg', 'oats'],
    ["Kellogg's Corn Flakes", 'cereal'],
    ['Haldiram Aloo Bhujia', 'namkeen'],
    ['Haldiram Rasgulla 1kg', 'sweets'],
    ['Nescafé Classic', 'coffee'],
    ['Thums Up 750ml', 'soft-drinks'],
    ['7UP 2.25L', 'soft-drinks'],
    ['Baking Soda', 'baking'],
    ['Surf Excel Matic Liquid', 'detergent'],
    ['Comfort Fabric Conditioner', 'detergent'],
    ['Dove Shampoo & Conditioner', 'hair-care'],
    ['Vim Dishwash Bar', 'dishwash'],
    ['Colgate Strong Teeth Toothpaste', 'oral-care'],
    ['Nivea Soft Face Cream', 'skin-care'],
  ])('%s is %s', (name, id) => expect(categorize(name)?.id).toBe(id))

  it.each(['Organic Fresh 500g', 'Mother Dairy', 'Amul Taaza 1L', "Haldiram's Special", 'Gift Hamper', ''])(
    'leaves "%s" uncategorized rather than guess',
    (name) => expect(categorize(name)).toBeUndefined(),
  )

  it.each([
    ['Greek Yogurt', 'GREEK   yogurt', 'Greek Yogurts', 'greek-yogurt'],
    ['Nescafé', 'NESCAFE', 'nescafe'],
    ['Tomato', 'tomatoes', 'TOMATOES'],
    ['Cookie', 'cookies'],
    ['Strawberry', 'strawberries'],
  ])('ignores case, spacing, accents and plurals for %s', (...names) => {
    const ids = new Set(names.map((n) => categorize(n)?.id))
    expect(ids.size).toBe(1)
    expect([...ids][0]).toBeDefined()
  })

  it('reports the term that matched', () => {
    expect(categorize('Amul Masti Dahi')).toEqual({ id: 'yogurt', term: 'dahi' })
  })
})

describe('stem', () => {
  it.each([
    ['berries', 'berry'], ['peaches', 'peach'], ['potatoes', 'potato'], ['boxes', 'box'],
    ['chips', 'chip'], ['glass', 'glass'], ['hummus', 'hummus'], ['oats', 'oat'],
  ])('%s -> %s', (word, expected) => expect(stem(word)).toBe(expected))
})

describe('taxonomy', () => {
  const ids = TAXONOMY.map(([id]) => id)

  it('has unique slug ids and unique names', () => {
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(TAXONOMY.map(([, name]) => name)).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,40}$/)
  })

  it('lists parents before children, at most 3 deep', () => {
    TAXONOMY.forEach(([id, , parent], at) => {
      if (!parent) return
      const before = ids.indexOf(parent)
      expect(before, id).toBeGreaterThanOrEqual(0)
      expect(before, id).toBeLessThan(at)
    })
    for (const c of CATEGORIES) expect(c.depth).toBeLessThanOrEqual(3)
  })

  it('never gives one term to two categories', () => {
    const owner = new Map<string, string>()
    for (const [id, , , terms] of TAXONOMY) {
      for (const term of terms.split(',').map((t) => t.trim()).filter(Boolean)) {
        const key = tokens(term).join(' ')
        expect(owner.get(key) ?? id, `"${term}"`).toBe(id)
        owner.set(key, id)
      }
    }
  })

  it('only marks known categories weak', () => {
    for (const id of WEAK) expect(ids).toContain(id)
  })
})

describe('categoryOf', () => {
  it('prefers your override', () => expect(categoryOf(item('x', 'Amul Masti Dahi', 'cheese'))).toBe('cheese'))
  it('falls back to the name for an unknown override', () => {
    expect(categoryOf(item('x', 'Amul Masti Dahi', 'retired-id'))).toBe('yogurt')
  })
})

describe('searcher', () => {
  const items = [
    item('dahi', 'Amul Masti Dahi'),
    item('greek', 'Epigamia Greek Yogurt Mango'),
    item('milk', 'Amul Taaza Toned Milk'),
    item('choc', 'Cadbury Dairy Milk Silk'),
    item('oat', 'So Good Oat Milk'),
    item('chips', 'Lays Chips'),
    item('mystery', 'Epigamia Mango 90g', 'greek-yogurt'),
  ]
  const find = (q: string) => items.filter(searcher(q)).map((i) => i.id)

  it('matches everything for an empty query', () => expect(find('  ')).toHaveLength(items.length))
  it('finds a category and its variants', () => expect(find('yogurt')).toEqual(['dahi', 'greek', 'mystery']))
  it('narrows to a variant', () => expect(find('greek yogurt')).toEqual(['greek', 'mystery']))
  it('understands synonyms', () => expect(find('curd')).toEqual(['dahi', 'greek', 'mystery']))
  it('combines a brand with a category', () => expect(find('amul curd')).toEqual(['dahi']))
  it('matches category names by prefix', () => expect(find('yog')).toEqual(['dahi', 'greek', 'mystery']))
  it('keeps plain name matches', () => expect(find('milk')).toEqual(['milk', 'choc', 'oat']))
  it('matches a parent category', () => expect(find('dairy')).toEqual(['dahi', 'greek', 'milk', 'choc', 'oat', 'mystery']))
  it('uses names only for one-letter words', () => expect(find('y')).toEqual(['greek', 'choc', 'chips']))
})
