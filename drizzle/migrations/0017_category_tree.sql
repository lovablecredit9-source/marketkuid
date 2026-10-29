ALTER TABLE public.product_categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS product_categories_parent_idx ON public.product_categories(parent_id);

DO $$
DECLARE
  tree jsonb := '{
    "AI Tools": ["9router","ChatGPT","Claude","CodeBuddy","Cursor","Devin","DreamFace","Gemini","Grok","Hermes","Kiro","Leonardo Ai","Magnific","Notion","Perplexity","Qoder","Replit","Windsurf"],
    "Aplikasi": ["Aplikasi POS","App Premium","Zoom"],
    "App Premium": ["Apple","Canva","Capcut","Get Contact","IQIYI","Spotify"],
    "Cloud": ["AWS","Digital Ocean","Domain","Hosting","Modal","Proxy","RDP","Upcloud","VPN","VPS","Vultr","Website"],
    "Design & Kreatif": ["Adobe","Alight Motion","Duolingo","Figma","Materi","Video Editing"],
    "Game Online": ["Catch And Tame","FreeFire","Mobile Legends","PUBG","Roblox"],
    "Roblox": ["Item"],
    "Lainnya": ["Jasa Verif","Lain-lain","OTP","Testing","VCC","Voucher"],
    "OTP": ["OTP SMS"],
    "Social Media": ["Digital Marketing","Discord","Email","Github","Google","Instagram","Telegram","Tiktok","X (Twitter)"],
    "Email": ["Gmail","Outlook"],
    "Tiktok": ["Akun TikTok"],
    "Software": ["Source Code","Windows"],
    "Streaming": ["Disney+","Netflix","Prime Video","Vidio Platinum TV","Viu","Youtube"]
  }';
  parent text; child text; pid uuid; nxt int;
BEGIN
  SELECT coalesce(max(sort),0) INTO nxt FROM public.product_categories;
  -- make sure every parent and child exists
  FOR parent IN SELECT jsonb_object_keys(tree) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = parent) THEN
      nxt := nxt + 1; INSERT INTO public.product_categories(name, sort) VALUES (parent, nxt);
    END IF;
    FOR child IN SELECT jsonb_array_elements_text(tree->parent) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = child) THEN
        nxt := nxt + 1; INSERT INTO public.product_categories(name, sort) VALUES (child, nxt);
      END IF;
    END LOOP;
  END LOOP;
  FOR parent IN SELECT jsonb_object_keys(tree) LOOP
    SELECT id INTO pid FROM public.product_categories WHERE name = parent LIMIT 1;
    UPDATE public.product_categories SET parent_id = pid
      WHERE name IN (SELECT jsonb_array_elements_text(tree->parent)) AND id <> pid;
  END LOOP;
END $$;