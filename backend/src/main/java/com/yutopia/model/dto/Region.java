package com.yutopia.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class Region {
    private Long regionId;
    private Long parentId;
    private String regionName;
    private String regionCode;
    private Integer regionLevel;
}
