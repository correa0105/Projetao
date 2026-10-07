-- Optional explicit six-layer selection. Legacy paint order/layout JSON stays intact.
ALTER TABLE house_presence ADD COLUMN depth_layer integer CHECK(depth_layer BETWEEN 1 AND 6);
