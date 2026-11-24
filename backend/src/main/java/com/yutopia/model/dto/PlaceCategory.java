package com.yutopia.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class PlaceCategory {
    private Long categoryId;
    private Long parentId;
    private String categoryName;
}
