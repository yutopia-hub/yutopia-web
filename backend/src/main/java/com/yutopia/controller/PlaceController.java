package com.yutopia.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.yutopia.controller.dto.PlaceDtos.AreaResponse;
import com.yutopia.controller.dto.PlaceDtos.PlaceResponse;
import com.yutopia.service.PlaceService;

import lombok.RequiredArgsConstructor;

/** 공개 조회 API (로그인 불필요). */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PlaceController {
    private final PlaceService placeService;

    @GetMapping("/places")
    public List<PlaceResponse> search(@RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long areaCode,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "30") int size) {
        return placeService.search(keyword, areaCode, page, size);
    }

    @GetMapping("/places/{placeId}")
    public PlaceResponse detail(@PathVariable String placeId) {
        return placeService.detail(placeId);
    }

    @GetMapping("/areas")
    public List<AreaResponse> areas() {
        return placeService.areas();
    }
}
