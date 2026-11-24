package com.yutopia;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import javax.sql.DataSource;

import org.apache.ibatis.session.SqlSessionFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;

import com.yutopia.support.DaoTestConfiguration;
import com.yutopia.support.TestDatabaseSafetyConfiguration;

class YutopiaApplicationTests {

    @Test
    @DisplayName("전체 Spring Boot 컨텍스트가 테스트 DB와 DAO 9개(CRUD 8 + 조회 1)를 등록한다")
    void contextLoads() throws Exception {
        try (var context = new SpringApplicationBuilder(YutopiaApplication.class, TestDatabaseSafetyConfiguration.class)
                .profiles("test").web(WebApplicationType.NONE).run()) {
            // Full application validation must use production auto-configuration, not the DAO fixture configuration.
            assertTrue(context.getBeansOfType(DaoTestConfiguration.class).isEmpty());
            var sqlSessionFactory = context.getBean(SqlSessionFactory.class);
            var dataSource = context.getBean(DataSource.class);
            assertEquals(9, sqlSessionFactory.getConfiguration().getMapperRegistry().getMappers().size());
            try (var connection = dataSource.getConnection()) {
                assertEquals("yutopia_test", connection.getCatalog());
            }
        }
    }

}
