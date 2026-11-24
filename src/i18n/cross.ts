/**
 * 需要「所有語言」的少數文字。翻譯檔改成依語言按需下載後，其他語言的全文平常不在記憶體裡，
 * 這幾個需要跨語言比對的字串另外放在這裡（cross.test.ts 會檢查跟翻譯檔一致，改翻譯時忘了同步會失敗）。
 */

/** 批次新增自動寫進備註的「批次建立」（各語言）：今天頁的時間軸不顯示 */
export const BATCH_NOTES: readonly string[] = ["批次建立", "まとめて作成", "Added in bulk", "일괄 생성", "Ajouté en groupe", "Gesammelt hinzugefügt"]

/** 庫存內建分類在各語言的名稱：自訂分類不能跟任何一種語言的內建名稱重複 */
export const INV_CATEGORY_NAMES: readonly string[] = ["個人護理", "居家日用", "廚房耗材", "低溫食材", "常溫食材", "健康醫療", "保養護膚", "文具用品", "其他", "パーソナルケア", "日用品", "キッチン消耗品", "冷蔵・冷凍食品", "常温食品", "健康・医療", "スキンケア", "文房具", "その他", "Personal care", "Household", "Kitchen", "Chilled & frozen food", "Pantry food", "Health", "Skincare", "Stationery", "Other", "개인 위생", "생활용품", "주방 소모품", "냉장·냉동 식품", "상온 식품", "건강·의료", "스킨케어", "문구류", "기타", "Hygiène personnelle", "Entretien de la maison", "Cuisine", "Produits frais et surgelés", "Épicerie", "Santé", "Soins de la peau", "Papeterie", "Autre", "Körperpflege", "Haushalt", "Küche", "Kühl- & Tiefkühlware", "Vorratsware", "Gesundheit", "Hautpflege", "Schreibwaren", "Sonstiges"]
